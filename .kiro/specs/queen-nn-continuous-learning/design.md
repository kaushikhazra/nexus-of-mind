# Queen Neural Network - Continuous Learning Design Document

## Overview

This design transforms the Queen AI from death-triggered learning to continuous real-time adaptation.

### Two-Stage Data Pipeline

**Stage 1 - Local Collection (Every 500ms)**
- Game state snapshots are collected locally in the frontend
- Stored in an in-memory buffer
- NO network calls at this stage
- Captures fine-grained temporal changes (unit movements, combat events, mining activity)

**Stage 2 - Batch Transmission (Every 10-20 seconds)**
- Accumulated snapshots are aggregated into a single observation batch
- ONE network call to backend per batch
- Backend processes batch, trains NN incrementally, generates new strategy
- Strategy sent back to Queen for immediate application

This approach ensures rich temporal data for learning while minimizing network overhead and backend load.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    GAME CLIENT (TypeScript)                             │
│                                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                      │
│  │  GameEngine     │───►│ ObservationCol- │───►│  WebSocket      │                      │
│  │                 │    │ lector (NEW)    │    │  Client         │                      │
│  │ • Unit positions│    │                 │    │                 │                      │
│  │ • Mining sites  │    │ • Buffer 500ms  │    │ • Send obs data │                      │
│  │ • Combat events │    │ • Batch 10-20s  │    │ • Recv strategy │                      │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘                      │
│                                                         │                               │
│  ┌─────────────────┐    ┌─────────────────┐             │                               │
│  │  Queen Entity   │◄───│ StrategyExec-   │◄────────────┘                               │
│  │                 │    │ utor (NEW)      │                                             │
│  │ • Spawn control │    │                 │    Receives strategy_update                 │
│  │ • Swarm command │    │ • Apply strategy│                                             │
│  │ • Behavior      │    │ • Smooth trans- │                                             │
│  └─────────────────┘    │   ition         │                                             │
│                         └─────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ WebSocket (ws://localhost:8000/ws)
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    AI BACKEND (Python)                                  │
│                                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                      │
│  │  WebSocket      │───►│ Observation     │───►│ Reward          │                      │
│  │  Handler        │    │ Processor       │    │ Calculator      │                      │
│  │                 │    │                 │    │                 │                      │
│  │ • Receive obs   │    │ • Validate      │    │ • Mining intrrpt│                      │
│  │ • Send strategy │    │ • Normalize     │    │ • Combat success│                      │
│  └─────────────────┘    │ • Feature eng   │    │ • Survival rate │                      │
│                         └─────────────────┘    └────────┬────────┘                      │
│                                                         │                               │
│  ┌─────────────────┐    ┌─────────────────┐             │                               │
│  │  Strategy       │◄───│ Neural Network  │◄────────────┘                               │
│  │  Generator      │    │ (Keras/TF)      │                                             │
│  │                 │    │                 │    reward signal                            │
│  │ • Map outputs   │    │ • Incremental   │                                             │
│  │ • Discretize    │    │   training      │                                             │
│  │ • Validate      │    │ • Inference     │                                             │
│  └─────────────────┘    └─────────────────┘                                             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐
│  Game   │          │ Observ- │          │ Backend │          │  Queen  │
│ Engine  │          │ ation   │          │   AI    │          │ Entity  │
└────┬────┘          └────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │                    │
     │  Game state        │                    │                    │
     │  (every 500ms)     │                    │                    │
     ├───────────────────►│                    │                    │
     │                    │                    │                    │
     │                    │  Buffer data       │                    │
     │                    │  (accumulate)      │                    │
     │                    ├──────────┐         │                    │
     │                    │          │         │                    │
     │                    │◄─────────┘         │                    │
     │                    │                    │                    │
     │                    │  After 10-20s      │                    │
     │                    │  send batch        │                    │
     │                    ├───────────────────►│                    │
     │                    │                    │                    │
     │                    │                    │  Process &         │
     │                    │                    │  Train NN          │
     │                    │                    ├──────────┐         │
     │                    │                    │          │         │
     │                    │                    │◄─────────┘         │
     │                    │                    │                    │
     │                    │                    │  Generate          │
     │                    │                    │  Strategy          │
     │                    │                    ├──────────┐         │
     │                    │                    │          │         │
     │                    │                    │◄─────────┘         │
     │                    │                    │                    │
     │                    │  strategy_update   │                    │
     │                    │◄───────────────────┤                    │
     │                    │                    │                    │
     │                    │                    │  Apply strategy    │
     │                    ├───────────────────────────────────────► │
     │                    │                    │                    │
     │                    │                    │                    │  Execute
     │                    │                    │                    │  decisions
     │                    │                    │                    ├──────┐
     │                    │                    │                    │      │
     │                    │                    │                    │◄─────┘
     │                    │                    │                    │
     └────────────────────┴────────────────────┴────────────────────┘
                               (Loop every 10-20 seconds)
```

## Neural Network Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              NEURAL NETWORK ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘

INPUT LAYER (20 neurons)                    HIDDEN LAYERS                OUTPUT LAYER (8 neurons)
─────────────────────────                   ─────────────              ──────────────────────────

Player State (7)                                                             Spawn Decisions (4)
┌───────────────────┐         ┌─────────┐       ┌─────────┐                ┌───────────────────┐
│ energy_level      │────┐    │         │       │         │            ┌───│ spawn_zone_x      │
│ mining_site_count │────┤    │  Dense  │       │  Dense  │            │   │ spawn_zone_y      │
│ worker_count      │────┤    │   64    │       │   32    │            │   │ spawn_rate        │
│ protector_count   │────┼───►│  ReLU   │──────►│  ReLU   │───────────►├───│ spawn_burst       │
│ base_health       │────┤    │         │       │         │            │   └───────────────────┘
│ avg_worker_dist   │────┤    │ Dropout │       │ Dropout │            │
│ mining_efficiency │────┤    │  0.2    │       │  0.2    │            │   Tactical Decisions (4)
└───────────────────┘    │    └─────────┘       └─────────┘            │   ┌───────────────────┐
                         │                                             ├───│ aggression_level  │
Spatial Features (6)     │                                             │   │ target_priority   │
┌───────────────────┐    │                                             │   │ formation_type    │
│ nearest_mine_dist │────┤                                             └───│ attack_timing     │
│ player_centroid_x │────┤                                                 └───────────────────┘
│ player_centroid_y │────┤
│ mining_centroid_x │────┤                     All outputs use Sigmoid
│ mining_centroid_y │────┤                     activation (0-1 range)
│ territory_control │────┤
└───────────────────┘    │
                         │
Queen State (4)          │
┌───────────────────┐    │
│ parasite_count    │────┤
│ queen_health      │────┤
│ time_since_spawn  │────┤
│ hive_discovered   │────┘
└───────────────────┘

Temporal Features (3)
┌───────────────────┐
│ game_time         │────┐
│ mining_intrpt_rate│────┼───► (included above)
│ combat_win_rate   │────┘
└───────────────────┘


Model Summary (with defaults):
──────────────────────────────
Layer 1: Dense(hidden_1, activation='relu', input_shape=(input_size,))
Layer 2: Dropout(dropout_rate)
Layer 3: Dense(hidden_2, activation='relu')
Layer 4: Dropout(dropout_rate)
Layer 5: Dense(output_size, activation='sigmoid')

Total Parameters: ~3,000 (with default config)
Training: Adam optimizer, lr=learning_rate
Loss: MSE (for continuous outputs) + custom reward-weighted loss
```

## Neural Network Configuration

The neural network architecture is fully configurable via a configuration file or environment variables.
This allows experimentation and tuning without code changes.

### Configuration Structure (Python Backend)

```python
# server/ai_engine/nn_config.py

from dataclasses import dataclass, field
from typing import List, Optional
import json
import os

@dataclass
class NNConfig:
    """Neural Network Configuration for Queen AI"""

    # Architecture
    input_size: int = 20                    # Number of input features (fixed by observation space)
    output_size: int = 8                    # Number of outputs (fixed by action space)
    hidden_layers: List[int] = field(default_factory=lambda: [64, 32])  # Hidden layer sizes
    dropout_rate: float = 0.2               # Dropout between layers
    hidden_activation: str = 'relu'         # Activation for hidden layers
    output_activation: str = 'sigmoid'      # Activation for output layer (0-1 range)

    # Training
    learning_rate: float = 0.001            # Adam optimizer learning rate
    batch_size: int = 32                    # Mini-batch size for training
    experience_buffer_size: int = 1000      # Max experiences to store
    min_samples_for_training: int = 32      # Min samples before training starts

    # Regularization
    l2_regularization: float = 0.0001       # L2 regularization strength
    gradient_clip: Optional[float] = 1.0    # Gradient clipping (None to disable)

    # Continuous Learning
    training_frequency: int = 1             # Train every N observations
    reward_discount: float = 0.95           # Reward discount factor (gamma)
    target_update_rate: float = 0.01        # Soft update rate for target network

    @classmethod
    def from_file(cls, path: str) -> 'NNConfig':
        """Load configuration from JSON file"""
        if os.path.exists(path):
            with open(path, 'r') as f:
                data = json.load(f)
            return cls(**data)
        return cls()  # Return defaults if file doesn't exist

    @classmethod
    def from_env(cls) -> 'NNConfig':
        """Load configuration from environment variables"""
        config = cls()
        if os.getenv('NN_HIDDEN_LAYERS'):
            config.hidden_layers = json.loads(os.getenv('NN_HIDDEN_LAYERS'))
        if os.getenv('NN_LEARNING_RATE'):
            config.learning_rate = float(os.getenv('NN_LEARNING_RATE'))
        if os.getenv('NN_DROPOUT_RATE'):
            config.dropout_rate = float(os.getenv('NN_DROPOUT_RATE'))
        if os.getenv('NN_BATCH_SIZE'):
            config.batch_size = int(os.getenv('NN_BATCH_SIZE'))
        return config

    def to_file(self, path: str) -> None:
        """Save configuration to JSON file"""
        with open(path, 'w') as f:
            json.dump(self.__dict__, f, indent=2)

    def describe(self) -> str:
        """Return human-readable description of architecture"""
        layers = [f"Input({self.input_size})"]
        for i, size in enumerate(self.hidden_layers):
            layers.append(f"Dense({size}, {self.hidden_activation})")
            layers.append(f"Dropout({self.dropout_rate})")
        layers.append(f"Output({self.output_size}, {self.output_activation})")
        return " → ".join(layers)
```

### Default Configuration File

```json
// server/config/nn_config.json
{
    "input_size": 20,
    "output_size": 8,
    "hidden_layers": [64, 32],
    "dropout_rate": 0.2,
    "hidden_activation": "relu",
    "output_activation": "sigmoid",
    "learning_rate": 0.001,
    "batch_size": 32,
    "experience_buffer_size": 1000,
    "min_samples_for_training": 32,
    "l2_regularization": 0.0001,
    "gradient_clip": 1.0,
    "training_frequency": 1,
    "reward_discount": 0.95,
    "target_update_rate": 0.01
}
```

### Configuration Presets

For easy experimentation, we provide several preset configurations:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              CONFIGURATION PRESETS                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

PRESET: "default"                    PRESET: "minimal"
──────────────────                   ─────────────────
hidden_layers: [64, 32]              hidden_layers: [32]
dropout_rate: 0.2                    dropout_rate: 0.1
learning_rate: 0.001                 learning_rate: 0.01
Parameters: ~3,000                   Parameters: ~1,000
Use case: Balanced                   Use case: Fast training, simple patterns

PRESET: "deep"                       PRESET: "wide"
────────────────                     ────────────────
hidden_layers: [64, 64, 32]          hidden_layers: [128, 64]
dropout_rate: 0.3                    dropout_rate: 0.2
learning_rate: 0.0005                learning_rate: 0.001
Parameters: ~6,000                   Parameters: ~5,500
Use case: Complex patterns           Use case: More feature interactions

PRESET: "aggressive_learning"
─────────────────────────────
hidden_layers: [64, 32]
dropout_rate: 0.1
learning_rate: 0.01
batch_size: 16
Use case: Rapid adaptation during gameplay
```

### Dynamic Model Building

```python
# In server/ai_engine/neural_network.py

def build_model(config: NNConfig) -> tf.keras.Model:
    """Build neural network from configuration"""
    model = tf.keras.Sequential()

    # Input layer (first hidden layer)
    model.add(tf.keras.layers.Dense(
        config.hidden_layers[0],
        activation=config.hidden_activation,
        input_shape=(config.input_size,),
        kernel_regularizer=tf.keras.regularizers.l2(config.l2_regularization)
    ))
    model.add(tf.keras.layers.Dropout(config.dropout_rate))

    # Additional hidden layers
    for size in config.hidden_layers[1:]:
        model.add(tf.keras.layers.Dense(
            size,
            activation=config.hidden_activation,
            kernel_regularizer=tf.keras.regularizers.l2(config.l2_regularization)
        ))
        model.add(tf.keras.layers.Dropout(config.dropout_rate))

    # Output layer
    model.add(tf.keras.layers.Dense(
        config.output_size,
        activation=config.output_activation
    ))

    # Compile
    optimizer = tf.keras.optimizers.Adam(
        learning_rate=config.learning_rate,
        clipnorm=config.gradient_clip
    )
    model.compile(optimizer=optimizer, loss='mse')

    return model
```

### Why These Defaults?

| Parameter | Default | Reasoning |
|-----------|---------|-----------|
| hidden_layers: [64, 32] | Follows 3:1 ratio from input, provides enough capacity for 20 features without overfitting |
| dropout: 0.2 | Standard regularization, prevents overfitting on small game batches |
| learning_rate: 0.001 | Adam default, stable for most cases |
| batch_size: 32 | Balance between training stability and update frequency |
| experience_buffer: 1000 | ~15-20 minutes of gameplay data at 10-20s intervals |

## Observation Data Structure

```typescript
// Frontend → Backend
interface ObservationData {
    timestamp: number;
    game_time: number;

    // Player State
    player: {
        energy: number;              // Current energy level
        mining_sites: MiningPosition[]; // Active mining locations
        workers: UnitPosition[];     // Worker unit positions
        protectors: UnitPosition[];  // Protector unit positions
        base_position: Position;     // Base location
        base_health: number;         // Base health %
    };

    // Queen State
    queen: {
        position: Position;
        health: number;
        parasites: UnitPosition[];   // Active parasite positions
        hive_position: Position;
        hive_discovered: boolean;
        last_spawn_time: number;
    };

    // Recent Events (last 20 seconds)
    events: {
        mining_interruptions: number;  // Count of successful interruptions
        parasites_killed: number;
        parasites_spawned: number;
        player_units_killed: number;
        combat_encounters: CombatEvent[];
    };
}

interface Position {
    x: number;
    y: number;
}

interface UnitPosition extends Position {
    id: string;
    health?: number;
}

interface MiningPosition extends Position {
    resource_remaining: number;
    workers_assigned: number;
}

interface CombatEvent {
    timestamp: number;
    location: Position;
    parasites_involved: number;
    player_units_involved: number;
    outcome: 'queen_win' | 'player_win' | 'draw';
}
```

## Strategy Update Structure

```typescript
// Backend → Frontend
interface StrategyUpdate {
    timestamp: number;
    version: number;           // Incremental strategy version
    confidence: number;        // Model confidence 0-1

    // Spawn Control
    spawn: {
        zone: Position;        // Primary spawn location
        rate: number;          // Parasites per second (0.1 - 2.0)
        burst_size: number;    // Parasites per burst (1-10)
        secondary_zones?: Position[]; // Alternative spawn points
    };

    // Tactical Control
    tactics: {
        aggression: number;    // 0 (defensive) - 1 (offensive)
        target_priority: 'MINERS' | 'PROTECTORS' | 'BASE' | 'BALANCED';
        formation: 'SWARM' | 'FLANK' | 'SURROUND' | 'DEFENSIVE';
        attack_timing: 'IMMEDIATE' | 'DELAYED' | 'OPPORTUNISTIC';
    };

    // Debug info (optional)
    debug?: {
        reward_signal: number;
        training_loss: number;
        feature_importance: number[];
    };
}
```

## Reward Calculation

```python
def calculate_reward(prev_state, curr_state, events):
    """
    Calculate reward signal for the current observation window.

    Rewards:
        +1.0  Major mining interruption (site abandoned)
        +0.5  Minor mining interruption (workers fled)
        +0.3  Player unit killed
        +0.2  Player forced to retreat
        +0.1  Territory maintained

    Penalties:
        -0.5  Parasite killed
        -0.3  Failed attack (no damage dealt)
        -0.2  Queen took damage
        -1.0  Hive discovered
    """
    reward = 0.0

    # Positive rewards
    reward += events.mining_interruptions * 0.5
    reward += events.player_units_killed * 0.3

    # Mining efficiency disruption
    prev_efficiency = prev_state.player.mining_efficiency
    curr_efficiency = curr_state.player.mining_efficiency
    if curr_efficiency < prev_efficiency:
        reward += (prev_efficiency - curr_efficiency) * 2.0

    # Negative rewards
    reward -= events.parasites_killed * 0.5
    reward -= events.failed_attacks * 0.3

    # Hive discovery is very bad
    if curr_state.queen.hive_discovered and not prev_state.queen.hive_discovered:
        reward -= 1.0

    # Normalize to [-1, 1] range
    return max(-1.0, min(1.0, reward))
```

## Component Details

### 1. ObservationCollector (Frontend - NEW)

```typescript
class ObservationCollector {
    private buffer: GameStateSnapshot[] = [];
    private collectionInterval: number = 500;    // ms
    private batchInterval: number = 15000;       // ms (configurable 10-20s)
    private lastBatchTime: number = 0;

    // Called from game loop
    public update(gameState: GameState, currentTime: number): void {
        // Collect snapshot every 500ms
        if (currentTime - this.lastCollectionTime >= this.collectionInterval) {
            this.buffer.push(this.createSnapshot(gameState));
            this.lastCollectionTime = currentTime;
        }

        // Send batch every 10-20s
        if (currentTime - this.lastBatchTime >= this.batchInterval) {
            this.sendBatch();
            this.lastBatchTime = currentTime;
        }
    }

    private createSnapshot(gameState: GameState): GameStateSnapshot {
        // Extract relevant data from game state
    }

    private sendBatch(): void {
        const observationData = this.aggregateSnapshots(this.buffer);
        websocket.send('observation_data', observationData);
        this.buffer = [];
    }
}
```

### 2. StrategyExecutor (Frontend - NEW)

```typescript
class StrategyExecutor {
    private currentStrategy: StrategyUpdate | null = null;
    private transitionProgress: number = 1.0;  // For smooth transitions

    public applyStrategy(strategy: StrategyUpdate): void {
        this.previousStrategy = this.currentStrategy;
        this.currentStrategy = strategy;
        this.transitionProgress = 0;
    }

    public getSpawnDecision(): SpawnDecision {
        if (!this.currentStrategy) return this.getDefaultSpawn();

        return {
            position: this.currentStrategy.spawn.zone,
            count: this.currentStrategy.spawn.burst_size,
            rate: this.currentStrategy.spawn.rate
        };
    }

    public getSwarmBehavior(): SwarmBehavior {
        if (!this.currentStrategy) return this.getDefaultBehavior();

        return {
            aggression: this.currentStrategy.tactics.aggression,
            targetPriority: this.currentStrategy.tactics.target_priority,
            formation: this.currentStrategy.tactics.formation
        };
    }
}
```

### 3. ContinuousTrainer (Backend - NEW)

```python
class ContinuousTrainer:
    def __init__(self, model_path: str):
        self.model = self.load_or_create_model(model_path)
        self.experience_buffer = deque(maxlen=1000)
        self.training_batch_size = 32

    def process_observation(self, obs_data: ObservationData) -> StrategyUpdate:
        # 1. Extract features
        features = self.extract_features(obs_data)

        # 2. Calculate reward from events
        reward = self.calculate_reward(obs_data)

        # 3. Store experience
        self.experience_buffer.append((features, reward))

        # 4. Train if enough samples
        if len(self.experience_buffer) >= self.training_batch_size:
            self.train_batch()

        # 5. Generate strategy via inference
        action = self.model.predict(features.reshape(1, -1))[0]

        # 6. Convert to strategy
        return self.action_to_strategy(action)

    def train_batch(self):
        # Sample from experience buffer
        batch = random.sample(self.experience_buffer, self.training_batch_size)

        # Incremental training with reward weighting
        for features, reward in batch:
            # Adjust target based on reward
            current_output = self.model.predict(features.reshape(1, -1))
            target = self.adjust_output_with_reward(current_output, reward)
            self.model.fit(features.reshape(1, -1), target, epochs=1, verbose=0)
```

## WebSocket Message Protocol

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              MESSAGE TYPES                                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘

1. observation_data (Frontend → Backend)
   ─────────────────────────────────────
   {
       "type": "observation_data",
       "payload": ObservationData,
       "sequence": number
   }

2. strategy_update (Backend → Frontend)
   ─────────────────────────────────────
   {
       "type": "strategy_update",
       "payload": StrategyUpdate,
       "in_response_to": number  // sequence number
   }

3. heartbeat (Bidirectional)
   ─────────────────────────────────────
   {
       "type": "heartbeat",
       "timestamp": number,
       "status": "alive"
   }

4. training_status (Backend → Frontend)
   ─────────────────────────────────────
   {
       "type": "training_status",
       "total_samples": number,
       "avg_reward": number,
       "model_version": number
   }

5. error (Bidirectional)
   ─────────────────────────────────────
   {
       "type": "error",
       "code": string,
       "message": string
   }
```

## Integration with Existing Code

### Files to Modify

| File | Changes |
|------|---------|
| `client/src/game/GameEngine.ts` | Add ObservationCollector integration |
| `client/src/game/entities/Queen.ts` | Add StrategyExecutor for spawn/behavior |
| `client/src/game/AdaptiveQueenIntegration.ts` | Update WebSocket message handling |
| `server/ai_engine/neural_network.py` | Add ContinuousTrainer class |
| `server/ai_engine/ai_engine.py` | Add continuous processing pipeline |
| `server/websocket/message_handler.py` | Add observation_data handler |

### Files to Create

| File | Purpose |
|------|---------|
| `client/src/game/systems/ObservationCollector.ts` | Collect and batch game state |
| `client/src/game/systems/StrategyExecutor.ts` | Execute NN decisions |
| `server/ai_engine/continuous_trainer.py` | Real-time training logic |
| `server/ai_engine/reward_calculator.py` | Reward signal computation |
| `server/ai_engine/feature_extractor.py` | Observation → features |

## Performance Considerations

1. **Frontend Collection**: Use object pooling to avoid GC during collection
2. **Data Compression**: Compress observation data before WebSocket transmission
3. **Batch Training**: Train on mini-batches, not single samples
4. **Inference Caching**: Cache strategy for 1-2 seconds between updates
5. **Feature Normalization**: Pre-compute normalization constants

## Fallback Behavior

If backend is unavailable or strategy is stale (>30s old):
1. Use last known strategy
2. If no strategy, use default aggressive behavior:
   - Spawn rate: 0.5 parasites/second
   - Aggression: 0.7
   - Target: MINERS
   - Formation: SWARM
