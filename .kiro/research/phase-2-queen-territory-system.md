# Phase 2: Basic Queen & Territory System

**Status**: 🎯 READY FOR IMPLEMENTATION  
**Duration**: 4-5 days  
**Priority**: HIGH - Critical foundation for AI learning system  
**Dependencies**: Phase 1 Enhanced Parasite System (COMPLETED)

## 🎯 Objective

Transform the game from scattered parasite encounters into territorial warfare with Queen-controlled regions, introducing high-stakes hive assault missions and territory liberation mechanics that create the foundation for neural network learning in Phase 3.

## 📋 User Stories

### US-004: Territory System Foundation
**As a player, I want to encounter distinct territorial zones controlled by Queens so that I understand the game world has organized AI opponents rather than random parasite spawns.**

**Acceptance Criteria:**
- [ ] Game world divided into 16x16 chunk territories (1024x1024 units each)
- [ ] Each territory has invisible boundaries with clear control areas
- [ ] Territories never overlap - each zone is distinct
- [ ] Visual indicators show when entering/exiting territories
- [ ] Territory boundaries align with existing chunk system (64 units per chunk)

### US-005: Queen Entity Implementation
**As a player, I want to encounter powerful Queen entities that control territories so that I have meaningful boss-level opponents to challenge.**

**Acceptance Criteria:**
- [ ] Queen entities have 40-100 hits (10x-20x parasite health)
- [ ] Queens are stationary and never leave their hive location
- [ ] Queens control all parasites within their territory boundaries
- [ ] Queens are only vulnerable when hive is constructed above ground
- [ ] Queens have distinct visual design - large, imposing, clearly different from parasites
- [ ] Queen death triggers immediate territory-wide parasite explosion

### US-006: Hive Structure System
**As a player, I want to discover and assault Queen hives so that I have strategic objectives beyond just mining resources.**

**Acceptance Criteria:**
- [ ] Hive structures have 20-30 hits (separate from Queen health)
- [ ] Hives spawn 50+ parasites of both types for defense
- [ ] Hive placement is random within territory boundaries
- [ ] Hive construction takes 10-15 seconds to emerge above ground
- [ ] Hives have clear above-ground visual structure for targeting
- [ ] Destroying hive kills the Queen and liberates territory

### US-007: Queen Lifecycle Management
**As a player, I want Queens to regenerate after death so that territories remain challenging and I have ongoing strategic objectives.**

**Acceptance Criteria:**
- [ ] Queen death immediately explodes all parasites in territory
- [ ] Territory becomes completely parasite-free for 3-5 minutes
- [ ] New Queen begins growing underground (invisible/invulnerable)
- [ ] Growth time is 60-120 seconds (simulating neural network training)
- [ ] UI shows Queen growth percentage in top-right corner
- [ ] Random hive location selected when Queen reaches 100% growth
- [ ] Hive construction phase makes Queen vulnerable again

### US-008: Territory Liberation Mechanics
**As a player, I want territory liberation to provide significant rewards so that hive assaults feel worthwhile despite the risks.**

**Acceptance Criteria:**
- [ ] 3-5 minutes of guaranteed parasite-free mining after Queen death
- [ ] 25% faster mining speed during liberation period
- [ ] Clear UI indicators showing liberation timer countdown
- [ ] Significant energy rewards from Queen kill (50-100 energy)
- [ ] Liberation window provides strategic expansion opportunities
- [ ] Players can safely establish forward mining operations during liberation

## 🏗️ Technical Implementation

### Territory Management System

```typescript
export interface Territory {
    id: string;
    centerPosition: Vector3;
    size: number; // 1024 units (16 chunks × 64 units)
    chunkBounds: ChunkBounds;
    queen: Queen | null;
    hive: Hive | null;
    controlStatus: 'queen_controlled' | 'liberated' | 'contested';
    liberationTimer: number;
}

export class TerritoryManager {
    private territories: Map<string, Territory> = new Map();
    private territoryGrid: TerritoryGrid;
    
    // Territory size constants
    private readonly TERRITORY_SIZE_CHUNKS = 16;
    private readonly CHUNK_SIZE = 64;
    private readonly TERRITORY_SIZE_UNITS = this.TERRITORY_SIZE_CHUNKS * this.CHUNK_SIZE; // 1024
    
    public createTerritory(centerX: number, centerZ: number): Territory {
        const territory: Territory = {
            id: this.generateTerritoryId(centerX, centerZ),
            centerPosition: new Vector3(centerX, 0, centerZ),
            size: this.TERRITORY_SIZE_UNITS,
            chunkBounds: this.calculateChunkBounds(centerX, centerZ),
            queen: null,
            hive: null,
            controlStatus: 'liberated',
            liberationTimer: 0
        };
        
        this.territories.set(territory.id, territory);
        return territory;
    }
    
    public getTerritoryAt(x: number, z: number): Territory | null {
        return this.territoryGrid.getTerritoryAt(x, z);
    }
    
    public liberateTerritory(territoryId: string): void {
        const territory = this.territories.get(territoryId);
        if (!territory) return;
        
        // Explode all parasites in territory
        this.explodeAllParasitesInTerritory(territory);
        
        // Set liberation status and timer
        territory.controlStatus = 'liberated';
        territory.liberationTimer = 300; // 5 minutes in seconds
        territory.queen = null;
        territory.hive = null;
        
        // Start Queen regeneration process
        this.startQueenRegeneration(territory);
    }
}
```

### Queen Entity System

```typescript
export enum QueenPhase {
    UNDERGROUND_GROWTH = 'underground_growth',
    HIVE_CONSTRUCTION = 'hive_construction',
    ACTIVE_CONTROL = 'active_control'
}

export class Queen {
    private id: string;
    private territory: Territory;
    private hive: Hive | null = null;
    private currentPhase: QueenPhase;
    private health: number = 60; // 40-100 range, start at 60
    private maxHealth: number = 60;
    
    // Growth phase properties
    private growthStartTime: number = 0;
    private growthDuration: number = 90; // 60-120 seconds, start at 90
    private growthProgress: number = 0; // 0.0 to 1.0
    
    constructor(territory: Territory) {
        this.id = `queen_${territory.id}_${Date.now()}`;
        this.territory = territory;
        this.currentPhase = QueenPhase.UNDERGROUND_GROWTH;
        this.startGrowthPhase();
    }
    
    public update(deltaTime: number): void {
        switch (this.currentPhase) {
            case QueenPhase.UNDERGROUND_GROWTH:
                this.updateGrowthPhase(deltaTime);
                break;
            case QueenPhase.HIVE_CONSTRUCTION:
                this.updateConstructionPhase(deltaTime);
                break;
            case QueenPhase.ACTIVE_CONTROL:
                this.updateControlPhase(deltaTime);
                break;
        }
    }
    
    private startGrowthPhase(): void {
        this.growthStartTime = Date.now();
        this.growthProgress = 0;
        this.currentPhase = QueenPhase.UNDERGROUND_GROWTH;
        
        // Notify UI to show growth progress
        EventBus.emit('queen_growth_started', {
            queenId: this.id,
            territoryId: this.territory.id,
            duration: this.growthDuration
        });
    }
    
    private updateGrowthPhase(deltaTime: number): void {
        const elapsed = (Date.now() - this.growthStartTime) / 1000;
        this.growthProgress = Math.min(1.0, elapsed / this.growthDuration);
        
        // Update UI
        EventBus.emit('queen_growth_progress', {
            queenId: this.id,
            progress: this.growthProgress,
            timeRemaining: Math.max(0, this.growthDuration - elapsed)
        });
        
        if (this.growthProgress >= 1.0) {
            this.startHiveConstruction();
        }
    }
    
    private startHiveConstruction(): void {
        this.currentPhase = QueenPhase.HIVE_CONSTRUCTION;
        
        // Select random hive location within territory
        const hiveLocation = this.selectRandomHiveLocation();
        
        // Create hive structure
        this.hive = new Hive(hiveLocation, this.territory);
        this.hive.startConstruction();
        
        EventBus.emit('hive_construction_started', {
            queenId: this.id,
            hiveLocation: hiveLocation,
            territoryId: this.territory.id
        });
    }
    
    public takeDamage(damage: number): boolean {
        if (this.currentPhase !== QueenPhase.ACTIVE_CONTROL || !this.hive?.isConstructed()) {
            return false; // Queen is invulnerable during growth/construction
        }
        
        this.health -= damage;
        
        if (this.health <= 0) {
            this.die();
            return true;
        }
        
        return false;
    }
    
    private die(): void {
        EventBus.emit('queen_death', {
            queenId: this.id,
            territoryId: this.territory.id,
            deathLocation: this.hive?.position || this.territory.centerPosition
        });
        
        // Territory manager will handle liberation
        TerritoryManager.getInstance().liberateTerritory(this.territory.id);
    }
}
```

### Hive Structure System

```typescript
export class Hive {
    private position: Vector3;
    private territory: Territory;
    private health: number = 25; // 20-30 range
    private maxHealth: number = 25;
    private isConstructed: boolean = false;
    private constructionStartTime: number = 0;
    private constructionDuration: number = 12; // 10-15 seconds
    private defensiveParasites: Parasite[] = [];
    
    constructor(position: Vector3, territory: Territory) {
        this.position = position;
        this.territory = territory;
    }
    
    public startConstruction(): void {
        this.constructionStartTime = Date.now();
        this.isConstructed = false;
        
        // Create visual construction effect
        this.createConstructionVisuals();
        
        EventBus.emit('hive_construction_progress', {
            hiveId: this.getId(),
            progress: 0,
            duration: this.constructionDuration
        });
    }
    
    public update(deltaTime: number): void {
        if (!this.isConstructed) {
            this.updateConstruction();
        } else {
            this.updateDefensiveSwarm();
        }
    }
    
    private updateConstruction(): void {
        const elapsed = (Date.now() - this.constructionStartTime) / 1000;
        const progress = Math.min(1.0, elapsed / this.constructionDuration);
        
        EventBus.emit('hive_construction_progress', {
            hiveId: this.getId(),
            progress: progress,
            timeRemaining: Math.max(0, this.constructionDuration - elapsed)
        });
        
        if (progress >= 1.0) {
            this.completeConstruction();
        }
    }
    
    private completeConstruction(): void {
        this.isConstructed = true;
        
        // Spawn defensive swarm (50+ parasites)
        this.spawnDefensiveSwarm();
        
        // Make Queen vulnerable
        EventBus.emit('hive_construction_complete', {
            hiveId: this.getId(),
            position: this.position,
            territoryId: this.territory.id
        });
    }
    
    private spawnDefensiveSwarm(): void {
        const swarmSize = 50 + Math.floor(Math.random() * 20); // 50-70 parasites
        
        for (let i = 0; i < swarmSize; i++) {
            const parasiteType = Math.random() < 0.25 ? ParasiteType.COMBAT : ParasiteType.ENERGY;
            const spawnPosition = this.getRandomSwarmPosition();
            
            const parasite = ParasiteFactory.createParasite(parasiteType, spawnPosition);
            parasite.setDefensiveMode(this.position); // Defend hive location
            
            this.defensiveParasites.push(parasite);
            GameWorld.getInstance().addEntity(parasite);
        }
    }
    
    public takeDamage(damage: number): boolean {
        if (!this.isConstructed) return false;
        
        this.health -= damage;
        
        if (this.health <= 0) {
            this.destroy();
            return true;
        }
        
        return false;
    }
    
    private destroy(): void {
        // Remove all defensive parasites
        this.defensiveParasites.forEach(parasite => {
            GameWorld.getInstance().removeEntity(parasite);
        });
        
        // Trigger Queen death
        EventBus.emit('hive_destroyed', {
            hiveId: this.getId(),
            position: this.position,
            territoryId: this.territory.id
        });
        
        // Remove hive visuals
        this.removeVisuals();
    }
}
```

### UI Components

```typescript
export class QueenGrowthUI {
    private container: HTMLElement;
    private progressBar: HTMLElement;
    private generationLabel: HTMLElement;
    private statusLabel: HTMLElement;
    private timeLabel: HTMLElement;
    
    constructor() {
        this.createUI();
        this.setupEventListeners();
    }
    
    private createUI(): void {
        this.container = document.createElement('div');
        this.container.className = 'queen-growth-ui';
        this.container.innerHTML = `
            <div class="queen-growth-header">
                <span class="crown-icon">👑</span>
                <span class="title">Queen Evolution</span>
            </div>
            <div class="generation-info">
                <span class="generation-label">Gen 1 → Gen 2</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <span class="progress-percentage">0%</span>
            </div>
            <div class="status-info">
                <span class="status-label">Growing Underground</span>
            </div>
            <div class="time-info">
                <span class="time-label">ETA: 90s</span>
            </div>
        `;
        
        // Position in top-right corner
        this.container.style.position = 'fixed';
        this.container.style.top = '20px';
        this.container.style.right = '20px';
        this.container.style.zIndex = '1000';
        
        document.body.appendChild(this.container);
        
        // Cache elements
        this.progressBar = this.container.querySelector('.progress-fill') as HTMLElement;
        this.generationLabel = this.container.querySelector('.generation-label') as HTMLElement;
        this.statusLabel = this.container.querySelector('.status-label') as HTMLElement;
        this.timeLabel = this.container.querySelector('.time-label') as HTMLElement;
    }
    
    public updateProgress(progress: number, timeRemaining: number): void {
        const percentage = Math.floor(progress * 100);
        
        this.progressBar.style.width = `${percentage}%`;
        this.container.querySelector('.progress-percentage')!.textContent = `${percentage}%`;
        this.timeLabel.textContent = `ETA: ${Math.ceil(timeRemaining)}s`;
    }
    
    public updateStatus(status: string): void {
        this.statusLabel.textContent = status;
    }
    
    public show(): void {
        this.container.style.display = 'block';
    }
    
    public hide(): void {
        this.container.style.display = 'none';
    }
}
```

## 🎮 Gameplay Flow

### Territory Discovery
1. Player explores game world during mining operations
2. Visual indicators show when entering Queen-controlled territory
3. Increased parasite activity signals territorial control
4. Players must decide whether to retreat or search for hive

### Hive Assault Mission
1. Player discovers hive construction in progress
2. Must navigate through defensive parasite swarm (50+ parasites)
3. Coordinate multiple protectors for sustained assault
4. Balance energy costs vs potential liberation rewards
5. Destroy hive to kill Queen and liberate territory

### Territory Liberation
1. Queen death triggers immediate parasite explosion across territory
2. 3-5 minute window of guaranteed parasite-free mining
3. 25% mining speed bonus during liberation period
4. Strategic opportunity for forward base establishment
5. Queen regeneration countdown creates urgency

### Queen Regeneration Cycle
1. New Queen begins growing underground (invisible/invulnerable)
2. 60-120 second growth period with UI progress indicator
3. Random hive location selection within territory
4. 10-15 second hive construction phase
5. Return to active territorial control with defensive swarm

## 🎯 Success Criteria

### Functional Requirements
- [ ] Territory system divides world into 16x16 chunk zones
- [ ] Queens control parasites within territorial boundaries
- [ ] Hive assault missions provide engaging combat challenges
- [ ] Territory liberation creates meaningful safe mining windows
- [ ] Queen regeneration cycle maintains ongoing territorial threats
- [ ] UI clearly communicates Queen growth progress and liberation status

### Performance Requirements
- [ ] 60fps maintained with Queen entities and hive structures
- [ ] <100MB additional memory usage for territory management
- [ ] <15% additional CPU overhead for Queen lifecycle management
- [ ] Smooth transitions between Queen phases without frame drops

### Player Experience Requirements
- [ ] 60%+ of players attempt hive assaults within first session
- [ ] Average 2+ successful territory liberations per session
- [ ] Clear visual feedback for all territorial mechanics
- [ ] Intuitive understanding of Queen vulnerability windows
- [ ] Engaging risk/reward balance for hive assault decisions

## 📝 Implementation Tasks

### Task 1: Territory Grid System
- [ ] Create TerritoryManager class with 16x16 chunk grid
- [ ] Implement territory boundary detection and visualization
- [ ] Add territory status tracking (controlled/liberated/contested)
- [ ] Create territory entry/exit event system

### Task 2: Queen Entity Implementation
- [ ] Create Queen class with lifecycle state management
- [ ] Implement underground growth phase (invisible/invulnerable)
- [ ] Add Queen health system and damage handling
- [ ] Create Queen death and territory liberation mechanics

### Task 3: Hive Structure System
- [ ] Create Hive class with construction and destruction mechanics
- [ ] Implement random hive placement within territory boundaries
- [ ] Add defensive parasite swarm spawning (50+ parasites)
- [ ] Create hive visual effects and construction animations

### Task 4: Queen Growth UI
- [ ] Create top-right UI component for Queen growth progress
- [ ] Implement progress bar and countdown timer
- [ ] Add generation tracking and status indicators
- [ ] Create smooth UI animations and transitions

### Task 5: Integration & Testing
- [ ] Integrate territory system with existing parasite spawning
- [ ] Test Queen lifecycle transitions and timing
- [ ] Validate hive assault gameplay balance
- [ ] Performance testing with multiple territories and Queens

### Task 6: Visual Polish
- [ ] Create distinct Queen visual design (large, imposing)
- [ ] Design hive structure appearance and construction effects
- [ ] Add territory boundary visual indicators
- [ ] Create parasite explosion effects for Queen death

## 🔄 Testing Strategy

### Unit Tests
- Territory boundary calculations and grid management
- Queen lifecycle state transitions and timing
- Hive construction and destruction mechanics
- UI component updates and event handling

### Integration Tests
- Territory system integration with existing parasite spawning
- Queen control over territorial parasites
- Hive assault combat mechanics with multiple protectors
- Liberation timer and mining bonus functionality

### Performance Tests
- Frame rate stability with multiple active Queens
- Memory usage with territory management system
- CPU overhead during Queen lifecycle transitions
- Network performance for future multiplayer considerations

### Gameplay Tests
- Hive assault difficulty and balance validation
- Territory liberation reward timing and value
- Queen regeneration cycle pacing and engagement
- Player discovery and understanding of territorial mechanics

## 📋 Definition of Done

- [ ] All user stories completed with acceptance criteria met
- [ ] Territory system successfully divides world into 16x16 chunk zones
- [ ] Queens demonstrate complete lifecycle from growth to death
- [ ] Hive assaults provide engaging high-risk, high-reward gameplay
- [ ] Territory liberation creates meaningful strategic opportunities
- [ ] UI clearly communicates all territorial mechanics to players
- [ ] Performance targets achieved (60fps, memory, CPU overhead)
- [ ] Integration tests pass with existing parasite and combat systems
- [ ] Code reviewed and documented according to project standards
- [ ] Ready for Phase 3 neural network learning integration

---

**Next Phase**: Phase 3 Neural Network Learning System - Use Queen death data to train adaptive AI behavior that learns from player strategies and becomes progressively more challenging across generations.