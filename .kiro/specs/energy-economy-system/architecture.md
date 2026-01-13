# Energy Economy System Architecture

## System Overview

The Energy Economy System provides comprehensive resource management for Nexus of Mind, where energy serves as the universal currency for all game actions. The architecture emphasizes transaction consistency, performance optimization, and strategic depth through resource scarcity and allocation decisions.

## Component Architecture

### Core Components

```typescript
EnergyEconomySystem
├── EnergyManager          // Global energy tracking and transactions
├── EnergyStorage          // Per-entity energy storage with capacity limits
├── EnergyConsumer         // Interface for energy-consuming actions
├── MineralDeposit         // Energy generation sources
├── EnergyDisplay          // Real-time UI feedback
└── EnergyActions          // Mining, building, and other energy actions
    ├── MiningAction
    ├── BuildingAction
    └── MovementAction
```

### Component Responsibilities

#### EnergyManager
- **Purpose**: Central energy economy coordination
- **Responsibilities**:
  - Track global energy balance and transactions
  - Validate energy availability before actions
  - Manage energy transfers between entities
  - Provide energy event notifications
- **Key Methods**: `validateTransaction()`, `transferEnergy()`, `getGlobalBalance()`

#### EnergyStorage
- **Purpose**: Per-entity energy storage management
- **Responsibilities**:
  - Store energy within capacity limits
  - Handle energy overflow and underflow
  - Support energy transfer operations
  - Provide storage status and visualization
- **Key Methods**: `store()`, `consume()`, `transfer()`, `getCapacity()`

#### EnergyConsumer Interface
- **Purpose**: Standardized energy consumption for actions
- **Responsibilities**:
  - Define energy cost calculation methods
  - Validate energy availability before execution
  - Handle insufficient energy scenarios
  - Provide energy cost transparency
- **Key Methods**: `calculateCost()`, `validateEnergy()`, `consumeEnergy()`

#### MineralDeposit
- **Purpose**: Energy generation through mining
- **Responsibilities**:
  - Store mineral capacity and extraction rates
  - Convert minerals to energy at defined ratios
  - Handle deposit depletion over time
  - Integrate with terrain generation system
- **Key Methods**: `mine()`, `getCapacity()`, `isDepeleted()`, `getExtractionRate()`

#### EnergyDisplay
- **Purpose**: Real-time energy UI feedback
- **Responsibilities**:
  - Display current energy levels and capacity
  - Show energy costs before actions
  - Provide energy consumption notifications
  - Update efficiently without performance impact
- **Key Methods**: `updateDisplay()`, `showCost()`, `displayNotification()`

## Data Flow Architecture

### Energy Transaction Flow
```
1. Action Request
   ├── EnergyConsumer.calculateCost()
   ├── EnergyManager.validateTransaction()
   └── Decision: Allow/Deny

2. Energy Consumption (if allowed)
   ├── EnergyStorage.consume()
   ├── EnergyManager.recordTransaction()
   └── EnergyDisplay.updateDisplay()

3. Action Execution
   ├── Perform game action
   ├── Generate results/effects
   └── Update game state
```

### Energy Generation Flow
```
1. Mining Operation
   ├── MineralDeposit.mine()
   ├── Calculate energy yield
   └── Apply mining efficiency

2. Energy Storage
   ├── EnergyStorage.store()
   ├── Handle capacity limits
   └── Manage overflow

3. UI Updates
   ├── EnergyDisplay.updateDisplay()
   ├── Show energy increase
   └── Update mining progress
```

### Energy Transfer Flow
```
1. Transfer Request
   ├── Validate source has sufficient energy
   ├── Validate target has storage capacity
   └── Calculate transfer efficiency

2. Transfer Execution
   ├── EnergyStorage.consume() from source
   ├── EnergyStorage.store() to target
   └── EnergyManager.recordTransaction()

3. Feedback
   ├── Update both entity displays
   ├── Show transfer animation/effect
   └── Log transaction for debugging
```

## Technical Architecture

### Energy Economics Model

#### Conversion Rates
```typescript
interface EnergyConversion {
    MINERAL_TO_ENERGY: 1.0;          // Base 1:1 conversion
    MINING_EFFICIENCY: 0.9;          // 90% base efficiency
    TRANSFER_LOSS: 0.05;             // 5% loss during transfers
    STORAGE_EFFICIENCY: 0.95;        // 5% loss during storage
}
```

#### Cost Structure
```typescript
interface EnergyCosts {
    // Mining operations
    MINING_INVESTMENT: 0.1;          // Energy per gram mined
    
    // Building construction
    BASE_CONSTRUCTION: 50;           // Base building cost
    POWER_PLANT_CONSTRUCTION: 30;    // Power plant cost
    
    // Unit operations
    MOVEMENT_WORKER: 0.5;            // Per unit distance
    MOVEMENT_SCOUT: 0.3;             // Most efficient movement
    MOVEMENT_PROTECTOR: 0.8;         // Heaviest movement cost
    
    // Combat operations
    COMBAT_SHOT_MIN: 2;              // Minimum combat cost
    COMBAT_SHOT_MAX: 5;              // Maximum combat cost
    SHIELD_ACTIVE: 1.0;              // Per second active
}
```

#### Storage Specifications
```typescript
interface StorageCapacities {
    // Unit storage
    WORKER: 10;                      // Balanced for mining operations
    SCOUT: 8;                        // Lower capacity, higher efficiency
    PROTECTOR: 12;                   // Highest capacity for combat
    
    // Building storage
    BASE: 100;                       // Central energy hub
    POWER_PLANT: 200;                // Maximum energy storage
}
```

### Performance Architecture

#### Transaction Optimization
```typescript
class EnergyTransactionBatcher {
    private pendingTransactions: EnergyTransaction[] = [];
    private batchSize = 50;
    private batchInterval = 16; // ~60fps
    
    public scheduleTransaction(transaction: EnergyTransaction): void {
        this.pendingTransactions.push(transaction);
        
        if (this.pendingTransactions.length >= this.batchSize) {
            this.processBatch();
        }
    }
    
    private processBatch(): void {
        // Process all transactions atomically
        const batch = this.pendingTransactions.splice(0, this.batchSize);
        this.energyManager.processBatch(batch);
    }
}
```

#### Memory Management
```typescript
class EnergyMemoryManager {
    private storagePool: EnergyStorage[] = [];
    private transactionPool: EnergyTransaction[] = [];
    
    public getStorage(): EnergyStorage {
        return this.storagePool.pop() || new EnergyStorage();
    }
    
    public releaseStorage(storage: EnergyStorage): void {
        storage.reset();
        this.storagePool.push(storage);
    }
}
```

#### UI Update Optimization
```typescript
class EnergyUIBatcher {
    private dirtyDisplays: Set<EnergyDisplay> = new Set();
    private updateScheduled = false;
    
    public markDirty(display: EnergyDisplay): void {
        this.dirtyDisplays.add(display);
        this.scheduleUpdate();
    }
    
    private scheduleUpdate(): void {
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(() => this.updateDisplays());
        }
    }
    
    private updateDisplays(): void {
        this.dirtyDisplays.forEach(display => display.update());
        this.dirtyDisplays.clear();
        this.updateScheduled = false;
    }
}
```

## Integration Architecture

### Game System Integration

#### Terrain System Integration
```typescript
// Mineral deposit placement during terrain generation
class TerrainEnergyIntegration {
    public generateMineralDeposits(chunk: TerrainChunk): MineralDeposit[] {
        const deposits: MineralDeposit[] = [];
        const biome = chunk.getBiome();
        
        // Biome-based deposit generation
        const depositCount = this.calculateDepositCount(biome);
        for (let i = 0; i < depositCount; i++) {
            const deposit = this.createMineralDeposit(chunk, biome);
            deposits.push(deposit);
        }
        
        return deposits;
    }
}
```

#### Unit System Integration
```typescript
// Energy storage integration with units
class UnitEnergyIntegration {
    public createUnit(type: UnitType, position: Vector3): GameUnit {
        const unit = new GameUnit(type, position);
        const storage = new EnergyStorage(this.getStorageCapacity(type));
        
        unit.addComponent(storage);
        this.energyManager.registerEntity(unit.id, storage);
        
        return unit;
    }
}
```

#### Building System Integration
```typescript
// Energy costs and storage for buildings
class BuildingEnergyIntegration {
    public constructBuilding(type: BuildingType, position: Vector3): boolean {
        const cost = this.getBuildingCost(type);
        
        if (this.energyManager.validateTransaction(cost)) {
            this.energyManager.consumeEnergy(cost);
            const building = this.createBuilding(type, position);
            return true;
        }
        
        return false;
    }
}
```

### External System Integration

#### UI System Integration
```typescript
// Real-time energy display integration
class EnergyUIIntegration {
    private displays: Map<string, EnergyDisplay> = new Map();
    
    public registerDisplay(entityId: string, display: EnergyDisplay): void {
        this.displays.set(entityId, display);
        this.energyManager.onEnergyChange(entityId, (energy) => {
            display.updateEnergy(energy);
        });
    }
}
```

#### Event System Integration
```typescript
// Energy events for game systems
interface EnergyEvents {
    onEnergyGenerated: (entityId: string, amount: number) => void;
    onEnergyConsumed: (entityId: string, amount: number) => void;
    onEnergyTransferred: (from: string, to: string, amount: number) => void;
    onInsufficientEnergy: (entityId: string, required: number) => void;
}
```

## Error Handling Architecture

### Transaction Validation
```typescript
class EnergyTransactionValidator {
    public validateTransaction(transaction: EnergyTransaction): ValidationResult {
        // Check energy availability
        if (!this.hassufficientEnergy(transaction)) {
            return ValidationResult.InsufficientEnergy;
        }
        
        // Check storage capacity
        if (!this.hasStorageCapacity(transaction)) {
            return ValidationResult.InsufficientCapacity;
        }
        
        // Check transaction consistency
        if (!this.isTransactionConsistent(transaction)) {
            return ValidationResult.InconsistentTransaction;
        }
        
        return ValidationResult.Valid;
    }
}
```

### Recovery Mechanisms
```typescript
class EnergyRecoveryManager {
    public recoverFromInconsistentState(): void {
        // Audit all energy storage
        const totalStored = this.auditStoredEnergy();
        const totalGenerated = this.auditGeneratedEnergy();
        const totalConsumed = this.auditConsumedEnergy();
        
        // Detect and correct inconsistencies
        if (totalStored !== (totalGenerated - totalConsumed)) {
            this.correctEnergyBalance();
        }
    }
}
```

## Security Architecture

### Energy Validation
```typescript
class EnergySecurityValidator {
    public validateEnergyOperation(operation: EnergyOperation): boolean {
        // Prevent negative energy
        if (operation.amount < 0 && !operation.isConsumption) {
            return false;
        }
        
        // Prevent energy duplication
        if (this.isDuplicateTransaction(operation)) {
            return false;
        }
        
        // Validate entity ownership
        if (!this.validateEntityOwnership(operation)) {
            return false;
        }
        
        return true;
    }
}
```

## Configuration Architecture

### Energy Configuration
```typescript
interface EnergyConfig {
    conversion: EnergyConversion;
    costs: EnergyCosts;
    storage: StorageCapacities;
    performance: {
        batchSize: number;
        updateInterval: number;
        maxTransactionsPerFrame: number;
    };
    validation: {
        enableStrictValidation: boolean;
        enableAuditLogging: boolean;
        enableRecoveryMechanisms: boolean;
    };
}
```

### Performance Tuning
```typescript
const ENERGY_PERFORMANCE_CONFIG = {
    // Transaction batching
    BATCH_SIZE: 50,
    BATCH_INTERVAL: 16, // ~60fps
    
    // Memory management
    STORAGE_POOL_SIZE: 100,
    TRANSACTION_POOL_SIZE: 200,
    
    // UI updates
    UI_UPDATE_THROTTLE: 33, // ~30fps for UI
    MAX_UI_UPDATES_PER_FRAME: 10,
    
    // Validation
    ENABLE_EXPENSIVE_VALIDATION: false, // Disable in production
    AUDIT_INTERVAL: 1000, // Every second
};
```

This architecture successfully provided the foundation for strategic resource management throughout Nexus of Mind's development, from the initial RTS concept through the innovative parasite ecosystem system. The energy economy created meaningful strategic decisions while maintaining excellent performance and reliability.